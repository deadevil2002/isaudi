import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { parse } from 'csv-parse/sync';

type ProductRow = Record<string, string>;
type OrderRow = Record<string, string>;

function normalize(str: any): string {
  return String(str || '').trim().toLowerCase();
}

function detectProductsHeaderIndex(rows: string[][]): number {
  const headerKeys = [
    'sku', 'no', 'no.', 'سعر المنتج', 'السعر',
    'اسم المنتج', 'أسم المنتج', 'الفئة', 'المخزون', 'النوع', 'type'
  ];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(normalize);
    const score = headerKeys.reduce((acc, key) => acc + (row.some(c => c.includes(key)) ? 1 : 0), 0);
    if (score >= 2) return i;
  }
  return 0;
}

function detectOrdersHeaderIndex(rows: string[][]): number {
  const headerKeys = ['رقم الطلب', 'إجمالي الطلب', 'اسماء المنتجات', 'sku', 'qty', 'الكمية', 'status', 'created'];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(normalize);
    const score = headerKeys.reduce((acc, key) => acc + (row.some(c => c.includes(key)) ? 1 : 0), 0);
    if (score >= 2) return i;
  }
  return 0;
}

function parsePriceToHalala(input: string | number | null | undefined): number {
  const s = String(input ?? '').trim();
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

function mapProduct(row: ProductRow) {
  // Attempt to resolve fields by Arabic/English synonyms
  const entries = Object.entries(row).reduce<Record<string, string>>((acc, [k, v]) => {
    acc[normalize(k)] = v;
    return acc;
  }, {});
  const type = entries['النوع'] || entries['type'] || '';
  const title = entries['أسم المنتج'] || entries['اسم المنتج'] || entries['product name'] || entries['name'] || '';
  const sku = entries['sku'] || entries['رمز المنتج'] || entries['رمز'] || '';
  const price = entries['سعر المنتج'] || entries['السعر'] || entries['price'] || '';
  const cost = entries['سعر التكلفة'] || entries['التكلفة'] || entries['cost'] || '';
  const inventory = entries['المخزون'] || entries['الكمية المتوفرة'] || entries['inventory'] || '';
  const category = entries['الفئة'] || entries['التصنيف'] || entries['category'] || 'General';
  const externalId = entries['no'] || entries['no.'] || entries['id'] || entries['المعرف'];
  return { type, title, sku, price, cost, inventory, category, externalId };
}

function mapOrder(row: OrderRow) {
  const entries = Object.entries(row).reduce<Record<string, string>>((acc, [k, v]) => {
    acc[normalize(k)] = v;
    return acc;
  }, {});
  const externalId = entries['رقم الطلب'] || entries['order id'] || entries['id'] || entries['no'] || '';
  const total = entries['إجمالي الطلب'] || entries['المبلغ الإجمالي'] || entries['total'] || entries['amount'] || '';
  const createdAt = entries['تاريخ الطلب'] || entries['order date'] || entries['created at'] || '';
  const status = entries['حالة الطلب'] || entries['status'] || 'completed';
  const itemsCount = entries['عدد المنتجات'] || entries['items count'] || entries['count'] || '';
  const itemsField = entries['اسماء المنتجات مع sku'] || entries['اسماء المنتجات'] || entries['products'] || entries['items'] || '';
  return { externalId, total, createdAt, status, itemsCount, itemsField };
}

function parseOrderItems(itemsField: string): Array<{ sku: string | null, name: string | null, qty: number }> {
  const items: Array<{ sku: string | null, name: string | null, qty: number }> = [];
  if (!itemsField) return items;
  const patterns: RegExp[] = [
    /\(sku:\s*([^)]+)\)\s*([^()]+?)\s*\(qty:\s*(\d+)\)/gi,
    /\(sku:\s*([^)]+)\)\s*([^()]+?)\s*\(الكمية:\s*(\d+)\)/gi,
    /([^()]+?)\s*\(qty:\s*(\d+)\)/gi,
  ];
  let matched = false;
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(itemsField)) !== null) {
      matched = true;
      if (re === patterns[2]) {
        items.push({ sku: null, name: (m[1] || '').trim(), qty: parseInt(m[2]) || 0 });
      } else {
        items.push({ sku: (m[1] || '').trim(), name: (m[2] || '').trim(), qty: parseInt(m[3]) || 0 });
      }
    }
    if (matched) break;
  }
  if (!matched) {
    // Fallback: split by comma and try to parse "name x qty"
    for (const part of itemsField.split(',')) {
      const p = part.trim();
      const m = /(.*?)[xX×]\s*(\d+)/.exec(p);
      if (m) items.push({ sku: null, name: m[1].trim(), qty: parseInt(m[2]) || 0 });
    }
  }
  return items.filter(i => i.qty > 0);
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = await dbService.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const productsFile = form.get('productsFile') as File | null;
    const ordersFile = form.get('ordersFile') as File | null;
    if (!productsFile || !ordersFile) {
      return NextResponse.json({ error: 'Both productsFile and ordersFile are required' }, { status: 400 });
    }

    const now = Date.now();
    await dbService.createOrUpdateStoreConnection({
      id: randomUUID(),
      userId: session.userId,
      platform: 'csv',
      status: 'connected',
    storeName: 'File Import Store',
      storeUrl: '',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      createdAt: now
    });

    const reportId = randomUUID();
    await dbService.createEmptyReport(reportId, session.userId);

    const warnings: string[] = [];
    let skippedProductsCount = 0;
    const skippedProductsExamples: number[] = [];
    let productsCount = 0;
    let ordersCount = 0;
    let orderItemsCount = 0;

    // Parse products file
    const productsText = Buffer.from(await productsFile.arrayBuffer()).toString('utf8');
    const prodRows: string[][] = parse(productsText, { relaxQuotes: true, relaxColumnCount: true, skipEmptyLines: true });
    const prodHeaderIndex = detectProductsHeaderIndex(prodRows);
    const prodHeaders = prodRows[prodHeaderIndex].map((h: any) => String(h));
  const prodRecords = prodRows.slice(prodHeaderIndex + 1).map(r => Object.fromEntries(r.map((v, i) => [prodHeaders[i] || `col${i}`, String(v)])));

  for (let i = 0; i < prodRecords.length; i++) {
      const raw = prodRecords[i];
    const item = mapProduct(raw);
    // Only keep actual products (skip options/variants)
    const normalizedType = normalize(item.type);
    if (normalizedType && normalizedType !== 'منتج' && normalizedType !== 'product') {
      continue;
    }
    if (!item.title || !item.price) {
        skippedProductsCount++;
        if (skippedProductsExamples.length < 5) {
          const rowNumber = prodHeaderIndex + 2 + i;
          skippedProductsExamples.push(rowNumber);
        }
        continue;
      }
    const extId = item.externalId || `csv-${randomUUID()}`;
    await dbService.upsertProduct({
        id: randomUUID(),
        userId: session.userId,
        platform: 'csv',
      externalId: extId,
        title: item.title,
        sku: item.sku || '',
      priceHalala: parsePriceToHalala(item.price),
        inventory: parseInt(item.inventory || '0') || 0,
        category: item.category || 'General',
        reportId,
        createdAt: now,
        updatedAt: now
      });
    // Auto-seed product_costs from cost column when available and not yet present
    const costHalala = parsePriceToHalala(item.cost || '');
    if (costHalala > 0) {
      const productRow = await dbService.getProductByExternalId(session.userId, extId);
      if (productRow) {
        const existingCost = await dbService.getProductCost(productRow.id);
        if (!existingCost) {
          await dbService.upsertProductCost(productRow.id, {
            purchase_cost_halala: costHalala
          });
        }
      }
    }
      productsCount++;
    }

    // Parse orders file
    const ordersText = Buffer.from(await ordersFile.arrayBuffer()).toString('utf8');
    const orderRows: string[][] = parse(ordersText, { relaxQuotes: true, relaxColumnCount: true, skipEmptyLines: true });
    const orderHeaderIndex = detectOrdersHeaderIndex(orderRows);
    const orderHeaders = orderRows[orderHeaderIndex].map((h: any) => String(h));
    const orderRecords = orderRows.slice(orderHeaderIndex + 1).map(r => Object.fromEntries(r.map((v, i) => [orderHeaders[i] || `col${i}`, String(v)])));

    let orderNoItemsExamples = 0;
    for (const raw of orderRecords) {
      const mapped = mapOrder(raw);
      if (!mapped.total) {
        if (orderNoItemsExamples < 5) warnings.push('Skipped order row due to missing total');
        continue;
      }
      const orderId = randomUUID();
      const totalHalala = Math.round(parseFloat(mapped.total) * 100) || 0;
      const createdAtTs = mapped.createdAt ? new Date(mapped.createdAt).getTime() : now;
      const items = parseOrderItems(mapped.itemsField || '');
      const totalQty = items.reduce((acc, it) => acc + it.qty, 0);

      await dbService.addOrder({
        id: orderId,
        userId: session.userId,
        platform: 'csv',
        externalId: mapped.externalId || `csv-${randomUUID()}`,
        reportId,
        totalHalala,
        status: mapped.status || 'completed',
        itemsCount: items.length || (parseInt(mapped.itemsCount || '0') || 1),
        createdAt: createdAtTs
      });
      ordersCount++;

      if (items.length === 0) {
        if (orderNoItemsExamples < 5) {
          warnings.push(`Order ${mapped.externalId || orderId} has no parsed items`);
          orderNoItemsExamples++;
        }
        continue;
      }
      for (const it of items) {
        const allocation = (items.length === 1 || totalQty === 0)
          ? totalHalala
          : Math.round((it.qty / totalQty) * totalHalala);
        await dbService.insertOrderItem({
          id: randomUUID(),
          report_id: reportId,
          order_id: orderId,
          sku: it.sku,
          product_name: it.name,
          qty: it.qty,
          allocated_revenue: allocation / 100, // store as real SAR
          created_at: now
        });
        orderItemsCount++;
      }
    }

    if (skippedProductsCount > 0) {
      const examplesText = skippedProductsExamples.map(n => `صف ${n}`).join(', ');
      warnings.unshift(`تم تخطي ${skippedProductsCount} صف من المنتجات بسبب نقص (الاسم/السعر). أمثلة: ${examplesText}`);
    }

    return NextResponse.json({
      success: true,
      reportId,
      counts: { products: productsCount, orders: ordersCount, orderItems: orderItemsCount },
      warnings
    });
  } catch (error) {
    console.error('File import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const { pool } = require('../config/db');
const { HttpError } = require('../utils/httpError');

const SORT_SQL = {
  price_asc: 'p.base_price ASC NULLS LAST, p.name ASC',
  price_desc: 'p.base_price DESC NULLS LAST, p.name ASC',
  name_asc: 'p.name ASC',
  name_desc: 'p.name DESC',
};

/**
 * @param {object} query
 * @param {string} [query.q]
 * @param {string} [query.min_price]
 * @param {string} [query.max_price]
 * @param {string} [query.sort]
 * @param {string} [query.category_id]
 */
async function listProducts(query = {}) {
  const {
    q,
    min_price: minPriceRaw,
    max_price: maxPriceRaw,
    sort: sortRaw,
    category_id: categoryId,
  } = query;

  const sortKey = typeof sortRaw === 'string' && sortRaw ? sortRaw : 'name_asc';
  if (!SORT_SQL[sortKey]) {
    throw new HttpError(400, 'Geçersiz sort. İzinli: price_asc, price_desc, name_asc, name_desc', 'INVALID_SORT');
  }
  const orderBy = SORT_SQL[sortKey];

  const params = [];
  const where = ['TRUE'];
  let i = 1;

  if (q != null && String(q).trim() !== '') {
    where.push(`p.search_vector @@ plainto_tsquery('simple', $${i})`);
    params.push(String(q).trim());
    i += 1;
  }

  let minVal;
  let maxVal;

  if (minPriceRaw !== undefined && minPriceRaw !== null && String(minPriceRaw).trim() !== '') {
    const v = Number(minPriceRaw);
    if (Number.isNaN(v) || v < 0) {
      throw new HttpError(400, 'Geçersiz min_price', 'INVALID_MIN_PRICE');
    }
    minVal = v;
    where.push(`p.base_price >= $${i}`);
    params.push(v);
    i += 1;
  }

  if (maxPriceRaw !== undefined && maxPriceRaw !== null && String(maxPriceRaw).trim() !== '') {
    const v = Number(maxPriceRaw);
    if (Number.isNaN(v) || v < 0) {
      throw new HttpError(400, 'Geçersiz max_price', 'INVALID_MAX_PRICE');
    }
    maxVal = v;
    where.push(`p.base_price <= $${i}`);
    params.push(v);
    i += 1;
  }

  if (minVal != null && maxVal != null && minVal > maxVal) {
    throw new HttpError(400, 'min_price değeri max_price değerinden büyük olamaz', 'INVALID_RANGE');
  }

  let ctePrefix = '';
  if (categoryId != null && String(categoryId).trim() !== '') {
    const cat = String(categoryId).trim();
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(cat)) {
      throw new HttpError(400, 'Geçersiz category_id', 'INVALID_CATEGORY');
    }
    ctePrefix = `
WITH RECURSIVE subtree AS (
  SELECT id FROM categories WHERE id = $${i}::uuid
  UNION ALL
  SELECT c.id
    FROM categories c
    INNER JOIN subtree s ON c.parent_id = s.id
)
`;
    params.push(cat);
    where.push(`p.category_id IN (SELECT id FROM subtree)`);
    i += 1;
  }

  const sql = `
${ctePrefix}
SELECT p.id,
       p.store_id,
       p.category_id,
       p.name,
       p.description,
       p.base_price,
       p.stock_count,
       cat.id AS category_ref_id,
       cat.name AS category_name,
       cat.parent_id AS category_parent_id
  FROM products p
  LEFT JOIN categories cat ON cat.id = p.category_id
 WHERE ${where.join(' AND ')}
 ORDER BY ${orderBy}
`;

  const { rows } = await pool.query(sql, params);
  return rows.map((row) => ({
    id: row.id,
    store_id: row.store_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    base_price: row.base_price,
    stock_count: row.stock_count,
    category: row.category_ref_id
      ? {
          id: row.category_ref_id,
          name: row.category_name,
          parent_id: row.category_parent_id,
        }
      : null,
  }));
}

module.exports = {
  listProducts,
};

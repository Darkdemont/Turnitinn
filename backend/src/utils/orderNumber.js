async function generateOrderNumber(client) {
  await client.query("UPDATE app_counters SET value = LAST_INSERT_ID(value + 1) WHERE name = 'order_number'");
  const result = await client.query('SELECT LAST_INSERT_ID() AS value');
  const sequence = String(result.rows[0].value).padStart(6, '0');
  const year = new Date().getFullYear();
  return `ORD-${year}-${sequence}`;
}

module.exports = {
  generateOrderNumber
};

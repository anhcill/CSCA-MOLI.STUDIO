const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('https://csca-molistudio-production.up.railway.app/api/payments/sepay-webhook', {
      gateway: 'SePay',
      transactionDate: '2026-04-21 12:40:00',
      accountNumber: '80003018784',
      subAccount: null,
      content: 'CSCA5T1776775246574',
      transferType: 'in',
      transferAmount: 2000,
      accumulated: 100000,
      channel: 'SMS',
      referenceCode: 'TEST12345'
    });
    console.log('Response:', res.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}
test();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'docs/video-commerce-day1-baseline.json');
const files = [
  'frontend/app/vip/page.tsx', 'frontend/app/checkout/page.tsx', 'frontend/app/checkout/success/page.tsx',
  'frontend/app/admin/vip/page.tsx', 'frontend/app/admin/coupons/page.tsx', 'frontend/app/khoa-hoc/page.tsx',
  'backend/src/routes/payments.js', 'backend/src/routes/vipPackageRoutes.js',
  'backend/src/models/Transaction.js', 'backend/src/models/User.js',
  'backend/src/controllers/vipPackageController.js', 'backend/src/controllers/adminVipController.js',
  'backend/src/controllers/couponController.js', 'backend/src/controllers/adminCouponController.js',
  'backend/src/controllers/paymentRiskActionsController.js', 'backend/src/services/coinService.js',
  'backend/src/repositories/courseRepository.js', 'backend/src/services/courseService.js',
];
const digest = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex');

if (process.argv[2] === '--record') {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const hashes = Object.fromEntries(files.map(file => [file, digest(execFileSync('git', ['show', `${commit}:${file}`],
    { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }))]));
  fs.writeFileSync(output, JSON.stringify({ commit, lineEndings: 'LF', purpose: 'Day 1 source baseline, not a rendered UI snapshot', files: hashes }, null, 2) + '\n');
} else if (!['--check','--day2','--day3','--day4'].includes(process.argv[2])) {
  console.error('Usage: node scripts/check_video_commerce_baseline.js --record|--check|--day2|--day3|--day4');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(output, 'utf8'));
const changed = Object.entries(baseline.files).filter(([file, hash]) => digest(fs.readFileSync(path.join(root, file), 'utf8')) !== hash).map(([file]) => file);
const day2Extensions = {
  'backend/src/routes/payments.js': 'Product dispatch and shared coupon/coin reservations',
  'backend/src/models/Transaction.js': 'Add product type to payment history',
  'backend/src/controllers/paymentRiskActionsController.js': 'Reconcile new orders; prevent legacy grant/revoke on them',
  'backend/src/services/coinService.js': 'Keep unresolved video/combo coin reservations',
};
const expected = ['--day3','--day4'].includes(process.argv[2])
  ? {...day2Extensions,'frontend/app/khoa-hoc/page.tsx':'Add links to video catalog and owned packages; preserve existing course layout'}
  : process.argv[2] === '--day2' ? day2Extensions : {};
if (process.argv[2] === '--day4') expected['backend/src/services/courseService.js'] = 'Check independent video rights and preserve enrollment revocation';
const unexpected = changed.filter(file => !Object.hasOwn(expected,file));
console.log(JSON.stringify({ baselineCommit: baseline.commit, checked: Object.keys(baseline.files).length,
  unchanged: Object.keys(baseline.files).length-changed.length, changed,
  intentionalExtensions: changed.filter(file => Object.hasOwn(expected,file)).map(file => ({file,reason:expected[file]})),
  unexpected, note: 'Source comparison only. Allowed backend extensions still require diff review and regression tests.' }, null, 2));
if (unexpected.length) process.exitCode = 1;

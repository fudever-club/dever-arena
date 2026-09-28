/**
 * DEVER Arena — Task 118: object store (S3 SigV4 zero-dep) cho source_code.
 * KHÔNG gọi mạng thật: test unit các helper + hành vi fallback khi chưa cấu hình.
 */
import test from 'node:test';
import assert from 'node:assert';

const { _test, objectStoreEnabled, objectStoreActive, putObject, getObject } = await import('../server/objectStore.js');

test('Task 118: uriEncode chuẩn SigV4 (kể cả ký tự đặc biệt, giữ "/")', () => {
  const { uriEncode } = _test;
  assert.equal(uriEncode('submissions/sub_abc.txt'), 'submissions%2Fsub_abc.txt');
  assert.equal(uriEncode('a/b c+d', false), 'a/b%20c%2Bd');
  assert.equal(uriEncode('ky-tu~_._-'), 'ky-tu~_._-');
  assert.equal(uriEncode('tiếng&việt=vn'), 'ti%E1%BA%BFng%26vi%E1%BB%87t%3Dvn');
});

test('Task 118: amzDate theo format x-amz-date ISO8601 basic', () => {
  const { amzDate } = _test;
  const { amz, short } = amzDate(new Date(Date.UTC(2026, 8, 28, 9, 30, 5)));
  assert.equal(amz, '20260928T093005Z');
  assert.equal(short, '20260928');
});

test('Task 118: sha256Hex đúng giá trị biến chứng (empty string)', () => {
  const { sha256Hex } = _test;
  assert.equal(
    sha256Hex(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('Task 118: local/test chưa cấu hình → store inactive, putObject/getObject trả null (fallback KV)', async () => {
  assert.equal(objectStoreEnabled, false, 'test env không được có S3_* env');
  assert.equal(objectStoreActive, false);
  assert.equal(await putObject('k', 'v'), null);
  assert.equal(await getObject('k'), null);
});

import {timingSafeEqual} from 'node:crypto';
export function adminAuthorized(header:string|null) {
  const user=process.env.ADMIN_USER,password=process.env.ADMIN_PASSWORD;
  if(!user||!password||password.length<12||!header?.startsWith('Basic '))return false;
  const actual=Buffer.from(header.slice(6),'base64'), expected=Buffer.from(`${user}:${password}`);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}

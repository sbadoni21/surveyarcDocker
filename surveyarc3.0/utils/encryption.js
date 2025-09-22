// utils/encryption.js
import CryptoJS from 'crypto-js';
const SECRET_KEY = 'my_super_secret_123'; // Replace with env in prod

export function encrypt(data) {
  return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
}
export function decrypt(encryptedData) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}







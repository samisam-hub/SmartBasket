module.exports = ({ config }) => {
  const value = process.env.ANDROID_VERSION_CODE;
  const versionCode = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('ANDROID_VERSION_CODE must be an integer between 1 and 2100000000');
  }
  return { ...config, android: { ...config.android, versionCode } };
};

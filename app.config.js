const {colors}=require('./assets/config/design-tokens.json');
module.exports = ({ config }) => {
  const value = process.env.ANDROID_VERSION_CODE;
  const versionCode = value === undefined ? 1 : Number(value);
  if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('ANDROID_VERSION_CODE must be an integer between 1 and 2100000000');
  }
  return { ...config, icon:'./assets/android/app-icon.png',
    plugins:[...(config.plugins??[]),['expo-splash-screen',{image:'./assets/splash/splash-logo.png',backgroundColor:colors.background,imageWidth:240,resizeMode:'contain'}]],
    android: { ...config.android, versionCode, icon:'./assets/android/app-icon.png',adaptiveIcon:{foregroundImage:'./assets/android/adaptive-icon-foreground.png',backgroundImage:'./assets/android/adaptive-icon-background.png',monochromeImage:'./assets/android/monochrome-icon.png',backgroundColor:colors.background} } };
};

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.danolipa.kurdishlibrary",
  appName: "کتێبخانەی کوردی",
  webDir: "dist",
  android: { allowMixedContent: false },
    plugins: { SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false, telegram: false, linkedin: false, tiktok: false } } }
};

export default config;
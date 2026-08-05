import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev サーバーを動かしたまま本番ビルドを走らせると .next を奪い合って dev が壊れるため、
  // ビルド確認時は BUILD_DIR=.next-build を指定して出力先を分ける。
  distDir: process.env.BUILD_DIR || ".next",
  // nodemailer は動的requireを使うためバンドルせず外部化する（Gmail送信用）。
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;

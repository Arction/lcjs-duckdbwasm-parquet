const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

const isProduction = process.env.NODE_ENV == "production";

const config = {
  entry: "./src/index.ts",
  output: {
    hashFunction: "sha256",
    path: path.resolve(__dirname, "dist"),
  },
  devServer: {
    static: path.join(__dirname, "dist"),
    compress: true,
    host: "localhost",
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: "lcjs-typescript-example",
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "node_modules/@lightningchart/lcjs/dist/resources",
          to: "resources",
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/i,
        loader: "ts-loader",
        exclude: ["/node_modules/"],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  externals: {
    perf_hooks: "{}",
  },
  optimization: {
    splitChunks: {
      chunks: "all",
    },
  },
};

module.exports = () => {
  if (isProduction) {
    config.mode = "production";
  } else {
    config.mode = "development";
  }
  return config;
};

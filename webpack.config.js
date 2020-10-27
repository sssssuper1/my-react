const path = require('path')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const resolve = (dir) => path.resolve(__dirname, dir)

const isDev = true

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: './src/index.js',
  output: {
    path: resolve('dist'),
    filename: 'bundle.[contenthash:8].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        include: [resolve('src')],
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-react',
              '@babel/preset-env',
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HTMLWebpackPlugin({
      template: './src/index.html'
    }),
  ],
  devServer: {
    contentBase: resolve('dist'),
    compress: true,
    port: 9000,
  },
  devtool: isDev ? 'source-map' : false,
}
const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // ワーカーファイルの設定
      webpackConfig.module.rules.push({
        test: /pdf\.worker\.min\.js$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/js/[name][ext]'
        }
      });

      // pdfjs-distのエイリアス設定
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        'pdfjs-dist': path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.js')
      };

      return webpackConfig;
    },
  },
  // ビルド時の設定
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/javascript'
    }
  }
};

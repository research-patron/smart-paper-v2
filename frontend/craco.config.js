const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // react-pdfのワーカーファイルの設定
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        // 必要に応じてエイリアスを設定
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
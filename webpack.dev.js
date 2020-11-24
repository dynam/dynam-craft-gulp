const webpack = require('webpack');
const path = require('path');
const sane = require('sane');

const WebpackNotifierPlugin = require('webpack-notifier');

require('dotenv').config();

module.exports = {

	mode: 'development',

	devtool: 'inline-source-map',

	entry: {
		main: './src/js/index.js',
	},

	output: {
		publicPath: '/dist',
		path: path.resolve(__dirname, './web/dist'),
		filename: 'js/[name].js',
	},

  optimization: {
    usedExports: true,
    splitChunks: {
      chunks (chunk) {
        //return !['dont-chunk-me'].includes(chunk.name);
        return true;
      }
    }
  },

	devServer: {
		host: process.env.DEVSERVER_HOST || 'localhost',
		port: process.env.DEVSERVER_PORT || 8080,
		contentBase: path.resolve(__dirname, './templates'),
		disableHostCheck: true,
		https: !!parseInt(process.env.DEVSERVER_HTTPS) || false,
		overlay: true,

		watchOptions: {
			poll: true,
			ignored: /node_modules/,
		},

		headers: {
			'Access-Control-Allow-Origin': '*'
		},

		proxy: !!parseInt(process.env.DEVSERVER_PROXY) ? {
			port: process.env.DEVSERVER_PROXY_PORT || 80,
			target: 'http' + (parseInt(process.env.DEVSERVER_HTTPS) ? 's' : '') + '://' + process.env.DEVSERVER_PROXY_TARGET,
			secure: false,
			context: () => true,
			changeOrigin: true,
		} : false,

		before: (app, server) => {
			const watcher = sane(path.resolve(__dirname, './templates'), {
				glob: ['**/*'],
				poll: true,
			});
			watcher.on('change', function (filePath, root, stat) {
				console.log('  File modified:', filePath);
				server.sockWrite(server.sockets, "content-changed");
			});
		},
	},

	module: {
		rules: [
			// Images
			{
				test: /\.(jpe?g|png|gif|svg)$/i,
				use: [
					{
						loader: 'url-loader',
						options: {
							// If the file is smaller than this, the image will be Base64 encoded
							// Note the high limit for dev mode - so that we get all the images injected
							limit: 300000,
							regExp: /(\/images\/.*)\.\w*$/,
							outputPath: '',
							name: '[1].[ext]',
						},
					},
				],
			},
			// CSS
			{
				test: /\.(sass|scss|css)$/,
				use: [
					{
						loader: 'style-loader'
					},
					{
						loader: 'css-loader',
						options: {
							sourceMap: true
						}
					},
					{
						loader: 'postcss-loader',
						options: {
							ident: 'postcss',
							plugins: [
								require('autoprefixer')(['last 3 versions', 'ie >= 9', 'android >= 4.4', 'ios >= 7']),
							],
							sourceMap: true,
						},
					},
					{
						loader: 'sass-loader',
						options: {
							sourceMap: true
						}
					},
				],
			},
		],
	},
	plugins: [
		new WebpackNotifierPlugin({
			title: 'Webpack',
			excludeWarnings: true,
			alwaysNotify: true
		}),
	],
};


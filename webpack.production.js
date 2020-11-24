// Webpack config - PRODUCTION

// Node modules
const webpack = require('webpack');
const path = require('path');

// Webpack plugins
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const FixStyleOnlyEntriesPlugin = require("webpack-fix-style-only-entries");
const WebpackNotifierPlugin = require('webpack-notifier');

module.exports = {

	mode: 'production',
	devtool: 'source-map',

	entry: {
		main: './src/js/index.js',
	},

	output: {
		publicPath: '/dist',
		path: path.resolve(__dirname, 'web/dist'),
		filename: 'js/[name].js',
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
							limit: 8000, // If the file is smaller than this, the image will be Base64 encoded
							regExp: /(\/img\/.*)\.\w*$/,
							outputPath: '',
							name: '[1].[ext]',
						},
					},
					{
						loader: 'img-loader',
						options: {
							plugins: [
								require('imagemin-gifsicle')({
									interlaced: false,
								}),
								require('imagemin-mozjpeg')({
									progressive: true,
									arithmetic: false,
								}),
								require('imagemin-optipng')({
									optimizationLevel: 4, // Higher than 2 starts to have a huge impact on build speed, but of course it saves smaller files
								}),
								require('imagemin-svgo')({
									plugins: [
										{removeTitle: true},
										{convertPathData: false},
									]
								})
							],
						}
					},
				],
			},
			// CSS
			{
				test:/\.(sass|scss|css)$/,
				use: [
					{
						loader: MiniCssExtractPlugin.loader,
					},
					{
						loader: 'css-loader',
						options: {
	                        sourceMap: true,
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

	optimization: {
    splitChunks: {
      chunks (chunk) {
        if(projectConfig && projectConfig.webpack && projectConfig.webpack.noChunk) {
          return !projectConfig.webpack.noChunk.includes(chunk.name);
        }
        else {
          return true;
        }
      }
    }
		minimizer: [
			new TerserJSPlugin({
				cache: true,
        parallel: true,
        sourceMap: true
			}),
			new OptimizeCSSAssetsPlugin({
				cssProcessorOptions: {
					map: {
						inline: false,
						annotation: true,
					},
					safe: true,
					discardComments: true,
				}
			}),
		],
	},

	plugins: [
		new WebpackNotifierPlugin({
			title: 'Webpack',
			excludeWarnings: true,
			alwaysNotify: true
		}),
		new FixStyleOnlyEntriesPlugin(),
		new CleanWebpackPlugin(),
		new MiniCssExtractPlugin({
			filename: 'css/[name].css',
		}),
  ],
};


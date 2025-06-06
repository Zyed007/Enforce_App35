module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./App'],
        alias: {
          App: './App',
        },
      },
    ],
  ],
};

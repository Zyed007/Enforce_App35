// App.js
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import createStore from './Stores';
import Router from './Containers/Route/Router';
import SplashScreen from './Containers/SplashScreen/SplashScreen';
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler';
import { Alert, AppState } from 'react-native';
import { handleGenerateUUID } from './helper';

const { store, persistor } = createStore();

const errorHandler = (e, isFatal) => {
  if (isFatal) {
    Alert.alert(
      'Unexpected error occurred',
      `
      Error: ${(isFatal) ? 'Fatal:' : ''} ${e.name} ${e.message}
      We have reported this to our team! Please close the app and start again.
      `,
      [{ text: 'Close' }]
    );
  } else {
    console.log(e); // For debugging non-fatal errors
  }
};

setJSExceptionHandler(errorHandler, true);
setNativeExceptionHandler(errorString => {
  // You can log or send to analytics if needed
});

export default class App extends Component {
  state = {
    appState: AppState.currentState,
  };

  componentDidMount() {
    AppState.addEventListener('change', this._handleAppStateChange);
    handleGenerateUUID(); // Generate UUID on app start
  }

  _handleAppStateChange = nextAppState => {
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground
    }
    this.setState({ appState: nextAppState });
  };

  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={<SplashScreen />} persistor={persistor}>
          <Router />
        </PersistGate>
      </Provider>
    );
  }
}

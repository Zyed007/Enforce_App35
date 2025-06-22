// Containers/Route/Router.js
import { NavigationContainer } from '@react-navigation/native';
import * as React from 'react';
import AppStack from '../../Navigators/ApplicationStack';
import AuthStack from '../../Navigators/AuthenticationStack';
import { navigationRef } from '../../Services/NavigationService';
import { LocalDBItems, getData } from '../../Services/LocalStorage';

export default function Router() {
  const [isUserLoggedIn, setIsUserLoggedIn] = React.useState(false);
  const [checkingAuth, setCheckingAuth] = React.useState(true);

  React.useEffect(() => {
    const checkLoginStatus = async () => {
      const isLogin = await getData(LocalDBItems.isUserAuthenticated);
      setIsUserLoggedIn(!!isLogin);
      setCheckingAuth(false);
    };
    checkLoginStatus();
  }, []);

  if (checkingAuth) return null; // or return <SplashScreen />

  return (
    <NavigationContainer ref={navigationRef}>
      {isUserLoggedIn ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

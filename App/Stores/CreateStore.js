import { applyMiddleware, compose, createStore } from 'redux'
import createSagaMiddleware from 'redux-saga'
import { persistReducer, persistStore } from 'redux-persist'
import AsyncStorage from '@react-native-async-storage/async-storage' // ✅ for React Native
 
const persistConfig = {
 key: 'root',
 storage: AsyncStorage, // ✅ corrected
 blacklist: [],
}
 
export default (rootReducer, rootSaga) => {
 const middleware = []
 const enhancers = []
 
 const sagaMiddleware = createSagaMiddleware()
 middleware.push(sagaMiddleware)
 enhancers.push(applyMiddleware(...middleware))
 
 const persistedReducer = persistReducer(persistConfig, rootReducer)
 const store = createStore(persistedReducer, compose(...enhancers))
 const persistor = persistStore(store)
 
 sagaMiddleware.run(rootSaga)
 
 return { store, persistor }
}
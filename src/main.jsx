import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import { GroupCallProvider } from './context/GroupCallContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <CallProvider>
            <GroupCallProvider>
              <App />
            </GroupCallProvider>
          </CallProvider>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>,
);

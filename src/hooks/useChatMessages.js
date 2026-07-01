import { useReducer, useCallback, useRef } from 'react';

const messageReducer = (state, action) => {
  switch (action.type) {
    case 'LOAD_HISTORY':
      return {
        ...state,
        messages: action.payload.isAppend 
          ? [...action.payload.data, ...state.messages] 
          : action.payload.data,
        hasMore: action.payload.data.length >= action.payload.limit,
        loading: false
      };
    case 'APPEND_NEW':
      // Prevent duplicates by checking unique message ID
      if (state.messages.some(m => m.id === action.payload.id || m.tempId === action.payload.tempId)) {
        return state;
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case 'CONFIRM_SENT':
      return {
        ...state,
        messages: state.messages.map(m => 
          m.tempId === action.payload.tempId ? { ...m, id: action.payload.id, status: 'sent' } : m
        )
      };
    case 'UPDATE_STATUS':
      return {
        ...state,
        messages: state.messages.map(m => 
          m.id === action.payload.id ? { ...m, status: action.payload.status } : m
        )
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    default:
      return state;
  }
};

export function useChatMessages() {
  const [state, dispatch] = useReducer(messageReducer, {
    messages: [],
    loading: false,
    hasMore: true
  });

  const appendNewMessage = useCallback((msg) => {
    dispatch({ type: 'APPEND_NEW', payload: msg });
  }, []);

  const confirmSent = useCallback((tempId, finalId) => {
    dispatch({ type: 'CONFIRM_SENT', payload: { tempId, id: finalId } });
  }, []);

  return {
    messages: state.messages,
    loading: state.loading,
    hasMore: state.hasMore,
    appendNewMessage,
    confirmSent,
    dispatch
  };
}

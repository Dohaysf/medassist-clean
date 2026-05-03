import React from 'react';
import './Message.css';

const Message = ({ text, sender }) => {
  return (
    <div className={`msg-row ${sender}`}>

      {/* Avatar BOT */}
      {sender === 'bot' && (
        <div className="avatar bot">🩺</div>
      )}

      {/* Message */}
      <div className="msg-content">
        <div className="bubble">{text}</div>
      </div>

      {/* Avatar USER */}
      {sender === 'user' && (
        <div className="avatar user">👤</div>
      )}

    </div>
  );
};

export default Message;
# Storage Units Chatbot - Expression of Interest

A ChatGPT-style chatbot designed to replace the "Ulverstone Secure Storage" section on the Harcourts website with an interactive "Expression of Interest" chatbot that integrates with n8n webhooks.

## Features

### 🤖 ChatGPT-Style Interface
- Modern, responsive design matching ChatGPT's interface
- Smooth animations and transitions
- Professional color scheme with gradients
- Mobile-responsive design

### 📝 User Information Collection
- Initial modal requesting Name and Email Address
- Required before starting conversation
- User data stored for webhook integration

### 🔗 n8n Webhook Integration
- Connects to: `https://hup.app.n8n.cloud/webhook/80351e0b-d9ed-4380-81d7-c8f284e566f4/chat`
- Sends user messages and information to webhook
- Handles responses from n8n workflows
- Fallback responses for connection issues

### 🏠 Virtual Tour Gallery
- **No webhook required** - displays locally
- Triggered by keywords: "virtual tour", "tour", "see", "view", "gallery", etc.
- Interactive gallery with storage unit images
- Detailed descriptions and action buttons
- Modal-style overlay display

### 📋 Waitlist Management
- **No webhook required** - handled locally
- Triggered by keywords: "waitlist", "join", "register", "interested", etc.
- Comprehensive form with:
  - Full Name
  - Email Address
  - Phone Number
  - Preferred Unit Size
  - Additional Notes
- Success confirmation message

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # Complete CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

## Implementation

### 1. Basic Setup
Simply open `index.html` in a web browser to see the chatbot in action.

### 2. Integration with Existing Website
To replace the "Ulverstone Secure Storage" section on the Harcourts website:

1. **Extract the chatbot code** from the three files
2. **Replace the target section** with the chatbot HTML
3. **Include the CSS** in your website's stylesheet
4. **Include the JavaScript** in your website's scripts
5. **Update the webhook URL** if needed

### 3. Customization

#### Webhook URL
Update the webhook URL in `script.js`:
```javascript
const WEBHOOK_URL = 'https://hup.app.n8n.cloud/webhook/80351e0b-d9ed-4380-81d7-c8f284e566f4/chat';
```

#### Virtual Tour Images
Replace placeholder images in the virtual tour gallery:
```html
<img src="your-actual-image-url.jpg" alt="Storage Unit Description">
```

#### Styling
Modify colors, fonts, and layout in `styles.css` to match your website's theme.

### 4. n8n Webhook Configuration

The webhook expects JSON data in this format:
```json
{
  "message": "User's message",
  "userInfo": {
    "name": "User Name",
    "email": "user@example.com"
  },
  "timestamp": "2025-10-02T10:30:00.000Z"
}
```

## Key Features Explained

### Intent Recognition
The chatbot uses keyword matching to identify user intents:

- **Virtual Tour**: Detects words like "tour", "see", "gallery", "photos"
- **Waitlist**: Detects words like "waitlist", "join", "register", "interested"

### Smart Response Handling
- **General conversation** → Sent to n8n webhook
- **Virtual tour requests** → Shows local gallery
- **Waitlist requests** → Shows local form

### User Experience
- **Typing indicators** during webhook calls
- **Smooth animations** for all interactions
- **Responsive design** for all devices
- **Keyboard shortcuts** (Enter to send, Escape to close modals)

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Security Considerations

- User data is only sent to the specified webhook
- No data is stored locally beyond the session
- HTTPS recommended for production use
- Input validation on all forms

## Troubleshooting

### Webhook Connection Issues
- Check webhook URL is correct
- Verify n8n webhook is set to "Public"
- Check browser console for error messages
- Ensure CORS is properly configured

### Modal Not Showing
- Check if JavaScript is enabled
- Verify all event listeners are properly attached
- Check for JavaScript errors in console

### Styling Issues
- Ensure CSS file is properly linked
- Check for conflicting styles in parent website
- Verify responsive breakpoints

## Future Enhancements

- **Multi-language support**
- **Advanced AI integration**
- **Analytics tracking**
- **Custom themes**
- **Voice input/output**
- **File upload support**

## Support

For technical support or customization requests, please refer to the n8n documentation or contact your development team.

---

**Note**: This chatbot is designed to be a drop-in replacement for the existing "Ulverstone Secure Storage" section. All functionality is self-contained and requires minimal integration with the existing website.

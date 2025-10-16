// Global variables
let userInfo = {
    name: '',
    email: ''
};

let isWaitingForResponse = false;
let sessionId = generateSessionId();
let hasUserInfo = false;
let hasExistingBooking = false;
let currentBookingData = null;
let activeBookingForm = null;

// Status management
let statusTimeout = null;
let inlineStatusElement = null;
let typingBubbleElement = null;

// Webhook URL
const WEBHOOK_URL = 'https://hup.app.n8n.cloud/webhook/80351e0b-d9ed-4380-81d7-c8f284e566f4/chat';

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Status management functions
function updateStatus(status, message = '') {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const statusMessage = document.getElementById('statusMessage');
    const header = document.querySelector('.chatbot-header');
    
    if (statusDot && statusText && statusMessage && header) {
        // Header always shows Online dot/text; indicators are inline below chat
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Online';
        statusText.style.color = '#10b981'; // Always keep green
        // Render inline indicator below chat bubble (text-only)
        if (message) renderInlineStatus(message, status); else removeInlineStatus();
        // Keep header clean/centered, no header message
        statusMessage.textContent = '';
            statusMessage.classList.remove('status-message-visible');
        header.classList.add('centered');
    }
}

function renderInlineStatus(text, animStatus = 'typing') {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    // Remove previous one
    removeInlineStatus();
    inlineStatusElement = document.createElement('div');
    inlineStatusElement.className = 'inline-status';
    inlineStatusElement.innerHTML = `
        <span class="inline-status-text ${animStatus}">${escapeHtml(String(text))}</span>
    `;
    chatMessages.appendChild(inlineStatusElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeInlineStatus() {
    if (inlineStatusElement && inlineStatusElement.parentNode) {
        inlineStatusElement.parentNode.removeChild(inlineStatusElement);
    }
    inlineStatusElement = null;
}

function setThinkingStatus() {
    updateStatus('thinking', 'Thinking...');
    
    // After 2 seconds, change to typing
    if (statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        updateStatus('typing', 'Typing...');
        
        // After 3 more seconds, change to almost done
        statusTimeout = setTimeout(() => {
            updateStatus('almost-done', 'Almost done...');
        }, 3000);
    }, 2000);
}

function setOnlineStatus() {
    if (statusTimeout) clearTimeout(statusTimeout);
    updateStatus('online', '');
}

function setOfflineStatus() {
    if (statusTimeout) clearTimeout(statusTimeout);
    updateStatus('offline', '');
}

// Initialize the chatbot
document.addEventListener('DOMContentLoaded', function() {
    // Show user info modal on load
    showUserInfoModal();
    
    // Setup event listeners
    setupEventListeners();
});

// Typing bubble helpers
function showTypingBubble() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    removeTypingBubble();
    const wrapper = document.createElement('div');
    wrapper.className = 'message bot-message';
    wrapper.innerHTML = `
        <div class="message-avatar">
            <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    typingBubbleElement = wrapper;
}

function removeTypingBubble() {
    if (typingBubbleElement && typingBubbleElement.parentNode) {
        typingBubbleElement.parentNode.removeChild(typingBubbleElement);
    }
    typingBubbleElement = null;
}

// Helper: Ensure a string is HTML; if plain text, escape and wrap in <p>
function ensureHtmlString(value) {
    const str = String(value);
    if (/<[^>]+>/.test(str)) return str;
    return `<p>${escapeHtml(str)}</p>`;
}

// Helper: Minimal HTML escape for plain text fallback
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Helper: Classify webhook HTML into card / table / list and wrap with variant class
function classifyWebhookHtml(htmlString) {
    try {
        const tmp = document.createElement('div');
        tmp.innerHTML = (htmlString || '').trim();
        const root = tmp.firstElementChild;
        const hasTable = !!tmp.querySelector('table');
        const hasList = !!tmp.querySelector('ul, ol');
        const hasVariantAlready = root && (
            root.classList.contains('webhook-card') ||
            root.classList.contains('webhook-table') ||
            root.classList.contains('webhook-list')
        );

        if (hasVariantAlready) {
            return tmp.innerHTML;
        }

        let variant = '';
        if (root && root.classList.contains('card')) {
            variant = 'webhook-card';
        } else if (hasTable) {
            variant = 'webhook-table';
        } else if (hasList) {
            variant = 'webhook-list';
        } else {
            variant = 'webhook-card';
        }

        return `<div class="${variant}">${tmp.innerHTML}</div>`;
    } catch (e) {
        const safe = ensureHtmlString(String(htmlString || ''));
        return `<div class="webhook-card">${safe}</div>`;
    }
}

function setupEventListeners() {
    // User info form submission
    const userInfoForm = document.getElementById('userInfoForm');
    if (userInfoForm) {
        userInfoForm.addEventListener('submit', handleUserInfoSubmit);
    }
    
    // Waitlist form submission
    const waitlistForm = document.getElementById('waitlistForm');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', handleWaitlistSubmit);
    }
    
    
    // Chat input
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    if (!chatInput || !sendButton) return; // Defensive: stop if core inputs missing
    
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    sendButton.addEventListener('click', sendMessage);
    
    // Input change handler
    chatInput.addEventListener('input', function() {
        updateSendButtonState();
        // The auto-resizing is now handled by CSS `field-sizing: content`
    });
    
    // Initialize send button state once listeners are attached
    updateSendButtonState();
}

function showUserInfoModal() {
    document.getElementById('userInfoModal').style.display = 'block';
}

function hideUserInfoModal() {
    document.getElementById('userInfoModal').style.display = 'none';
}

function handleUserInfoSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    userInfo.name = formData.get('userName');
    userInfo.email = formData.get('userEmail');
    
    if (userInfo.name && userInfo.email) {
        hasUserInfo = true;
        hideUserInfoModal();
        enableChat();
        // Only add ONE welcome message
        addBotMessage(`Hello ${userInfo.name}! I'm here to help you with information about our storage units. How can I assist you today?`);
        // Add quick action buttons
        addQuickActions();
        // Update send button state after user info is set
        updateSendButtonState();
    }
}

function enableChat() {
    document.getElementById('chatInput').disabled = false;
    document.getElementById('chatInput').focus();
    // Update send button state
    updateSendButtonState();
}

function updateSendButtonState() {
    const sendButton = document.getElementById('sendButton');
    const chatInput = document.getElementById('chatInput');
    const hasText = chatInput.value.trim().length > 0;
    const shouldDisable = !hasText || isWaitingForResponse || !hasUserInfo;
    
    console.log('Send button state:', {
        hasText,
        isWaitingForResponse,
        hasUserInfo,
        shouldDisable
    });
    
    sendButton.disabled = shouldDisable;
}

function addQuickActions() {
    // Use docked quick actions if present; avoid duplicating inside messages
    const dock = document.getElementById('quickActionsDock');
    if (dock) return; // Already rendered in HTML
}

function handleQuickAction(action) {
    switch(action) {
        case 'virtual-tour':
            // Directly trigger virtual tour without webhook
            expireActiveBookingForm();
            setQuickActionStatus('Loading virtual tour...');
            handleVirtualTourRequest();
            break;
        case 'waitlist':
            // Directly trigger waitlist without webhook
            expireActiveBookingForm();
            setQuickActionStatus('Preparing waitlist form...');
            handleWaitlistRequest();
            break;
        case 'book-now':
            // Check for existing booking first
            expireActiveBookingForm();
            setQuickActionStatus('Setting up booking...');
            handleBookingRequest();
            break;
    }
}

function setQuickActionStatus(message) {
    // Use inline indicator for quick actions (no header changes)
    renderInlineStatus(message, 'typing');
    setTimeout(() => {
        removeInlineStatus();
    }, 1500);
}

function addBotMessage(text, isTyping = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';

    let content;
    if (isTyping) {
        // This part is for the typing indicator
        content = `
            <div class="message-avatar">
                <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
    } else {
        // If the text is already HTML, use it directly. Otherwise, wrap in <p>.
        const innerHTML = /<[a-z][\s\S]*>/i.test(text) ? text : `<p>${escapeHtml(text)}</p>`;
        content = `
            <div class="message-avatar">
                <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
            </div>
            <div class="message-content">
                ${innerHTML}
            </div>
        `;
    }

    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(text) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
            <p>${text}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message || isWaitingForResponse) return;
    
    // Expire any active booking form when user sends a message
    expireActiveBookingForm();
    
    // Add user message
    addUserMessage(message);
    chatInput.value = '';
    document.getElementById('sendButton').disabled = true;
    
    // Send all user messages to webhook for general conversation
    sendToWebhook(message);
}

// The auto-resize function is no longer needed thanks to `field-sizing: content` in CSS.

// Removed keyword detection functions - Virtual Tour and Waitlist only accessible via quick actions

function handleVirtualTourRequest() {
    // Show typing bubble first, then set thinking status (inline appears below)
    showTypingBubble();
    setThinkingStatus();
    
    setTimeout(() => {
        // Remove typing indicator and set online status
        removeTypingBubble();
        removeInlineStatus();
        setOnlineStatus();
        
        // Add response with inline gallery
        addBotMessage('Great! I\'ll show you our virtual tour gallery. Here you can see different storage unit options available.');
        
        setTimeout(() => {
            addVirtualTourGallery();
        }, 500);
    }, 1500);
}

function showVirtualTourGallery() {
    document.getElementById('virtualTourGallery').style.display = 'flex';
}

function closeVirtualTour() {
    document.getElementById('virtualTourGallery').style.display = 'none';
}

function handleWaitlistRequest() {
    // Show typing bubble first, then set thinking status (inline appears below)
    showTypingBubble();
    setThinkingStatus();
    
    setTimeout(() => {
        // Remove typing indicator and set online status
        removeTypingBubble();
        removeInlineStatus();
        setOnlineStatus();
        
        // Add response with inline waitlist form
        addBotMessage('I\'d be happy to help you join our waitlist! Please fill out the form below.');
        
        setTimeout(() => {
            addWaitlistForm();
        }, 500);
    }, 1500);
}

function showWaitlistModal() {
    document.getElementById('waitlistModal').style.display = 'block';
}

function closeWaitlistModal() {
    document.getElementById('waitlistModal').style.display = 'none';
}

function openVirtualTour(url) {
    window.open(url, '_blank');
}

function openWaitlistForm() {
    window.open('https://forms.office.com/r/FBLuyQjwgG', '_blank');
    closeWaitlistModal();
    addBotMessage('I\'ve opened the waitlist form for you. Please fill it out to join our waitlist and we\'ll contact you when storage units become available.');
}

function addVirtualTourGallery() {
    const chatMessages = document.getElementById('chatMessages');
    const galleryDiv = document.createElement('div');
    galleryDiv.className = 'message bot-message inline-gallery';
    galleryDiv.innerHTML = `
        <div class="message-avatar">
            <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
        </div>
        <div class="message-content">
            <div class="inline-gallery-container">
                <div class="gallery-header">
                    <h4>Virtual Tour Gallery</h4>
                    <p>Explore our storage facilities</p>
                </div>
                <div class="gallery-carousel">
                    <button class="carousel-arrow carousel-prev" onclick="changeGallerySlide(-1)" style="display: none;">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="gallery-track">
                        <div class="gallery-slide active">
                            <div class="gallery-image-container">
                                <img src="https://assets.cloudhi.io/media/c96b3f0f-8340-4234-81d5-5131676577b9/013dc124-6518-43de-8567-9c868c8ff49b/8cCZaTzOBeFmff4CBU31SyDEtFOno0lrUifUcxOj.jpg.webp" alt="Ulverstone Secure Storage">
                                <div class="gallery-image-title">Ulverstone Secure Storage</div>
                            </div>
                            <div class="gallery-slide-content">
                                <div class="gallery-details-scroll">
                                    <p>Located at 45 Fieldings Way is the Ulverstone Secure Storage Facility. Comprising of over 80 units ranging from colourbond sheds with concrete floors to shipping containers, this facility has something for everyone.</p>
                                    <p><strong>Security:</strong> Known for its high level of security with 24/7 CCTV, lights and keyed access, the facility is accessible to tenants at all hours of the day/night.</p>
                                    <p><strong>Pricing:</strong> $226 per month for a large storage unit the size of a single garage, with some smaller containers available at $152 per month.</p>
                                    <p><strong>Availability:</strong> With limited availability, we suggest you join the waitlist by completing the form linked at the bottom of this page.</p>
                                </div>
                                <button class="btn-primary gallery-btn" onclick="openVirtualTour('https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fvirtual-tour.ipropertyexpress.com%2Fvt%2Ftour%2F3a602bd0-1aa7-4d55-8bf3-27832048ab66&data=05%7C02%7Cstorageup%40harcourts.com.au%7C6fa2e8af265844da21308dcecd69ab3%7Cad59963c5d07405f9dce1dbdb4e4f139%7C0%7C0%7C638645653657778934%7CUnknown%7CTWFpbGZsb3d8eyJWIjoiMC4wLjAwMDAiLCJQIjoiV2luMzIiLCJBTiI6Ik1haWwiLCJXVCI6Mn0%3D%7C0%7C%7C%7C&sdata=e72Xp%2Fq3FUCuhKOYE6FlJbULLzL%2Fcp90gocXUIQzIU4%3D&reserved=0')">
                                    <i class="fas fa-camera"></i> Virtual Tour
                                </button>
                            </div>
                        </div>
                        <div class="gallery-slide">
                            <div class="gallery-image-container">
                                <img src="https://assets.cloudhi.io/media/c96b3f0f-8340-4234-81d5-5131676577b9/013dc124-6518-43de-8567-9c868c8ff49b/ZKqlXkXfc4axjy7mUdMPmWpPkEzbV8yGQpbW1Ylc.jpg.webp" alt="Deegan Marine">
                                <div class="gallery-image-title">Deegan Marine</div>
                            </div>
                            <div class="gallery-slide-content">
                                <div class="gallery-details-scroll">
                                    <p>Located at the roundabout on Eastland Drive, Deegan Marine houses shipping container storage for your convenience. With large and small options, there is something to suit everyone.</p>
                                    <p><strong>Access:</strong> Accessible only during Deegan Marine business hours, this facility is ideal for the long haul or boat storage.</p>
                                    <p><strong>Pricing:</strong> Priced from $120 per month.</p>
                                    <p><strong>Availability:</strong> With limited availability, we suggest you join the waitlist by completing the form linked at the bottom of this page.</p>
                                </div>
                                <button class="btn-primary gallery-btn" onclick="openVirtualTour('https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fvirtual-tour.ipropertyexpress.com%2Fvt%2Ftour%2Fb3b9ce51-5643-4565-93df-5e59e7f77285&data=05%7C02%7Cstorageup%40harcourts.com.au%7C8a803292c78f48408c4608dcecd6c5cd%7Cad59963c5d07405f9dce1dbdb4e4f139%7C0%7C0%7C638645654377476796%7CUnknown%7CTWFpbGZsb3d8eyJWIjoiMC4wLjAwMDAiLCJQIjoiV2luMzIiLCJBTiI6Ik1haWwiLCJXVCI6Mn0%3D%7C0%7C%7C%7C&sdata=IQwC0d1UB6y%2F8RVZSI2WaKW7y16Jc1mv0xD8qnZJ27g%3D&reserved=0')">
                                    <i class="fas fa-camera"></i> Virtual Tour
                                </button>
                            </div>
                        </div>
                    </div>
                    <button class="carousel-arrow carousel-next" onclick="changeGallerySlide(1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="gallery-dots">
                    <span class="dot active" onclick="goToSlide(0)"></span>
                    <span class="dot" onclick="goToSlide(1)"></span>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(galleryDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Update total slides count dynamically and adjust track width
    totalSlides = document.querySelectorAll('.gallery-slide').length;
    updateCarouselDimensions();
    
    // Add animation
    setTimeout(() => {
        galleryDiv.style.opacity = '1';
        galleryDiv.style.transform = 'translateY(0)';
    }, 100);
}

function addWaitlistForm() {
    const chatMessages = document.getElementById('chatMessages');
    const formDiv = document.createElement('div');
    formDiv.className = 'message bot-message inline-waitlist';
    formDiv.innerHTML = `
        <div class="message-avatar">
            <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
        </div>
        <div class="message-content">
            <div class="inline-waitlist-container">
                <div class="waitlist-header">
                    <h4>Want to join the waitlist?</h4>
                    <p>Submit your interest here</p>
                </div>
                <div class="waitlist-body">
                    <p>Get notified when storage units become available. We'll contact you as soon as a unit matching your needs becomes available.</p>
                    <button class="btn-primary waitlist-btn" onclick="openWaitlistForm()">
                        <i class="fas fa-external-link-alt"></i> Expressions of Interest
                    </button>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(formDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add animation
    setTimeout(() => {
        formDiv.style.opacity = '1';
        formDiv.style.transform = 'translateY(0)';
    }, 100);
}

// Carousel navigation functions
let currentSlide = 0;
let totalSlides = 2; // Will be updated dynamically

function changeGallerySlide(direction) {
    const track = document.querySelector('.gallery-track');
    const dots = document.querySelectorAll('.dot');
    const prevArrow = document.querySelector('.carousel-prev');
    const nextArrow = document.querySelector('.carousel-next');
    
    if (!track) return;
    
    currentSlide += direction;
    
    // Don't loop around - stop at boundaries
    if (currentSlide >= totalSlides) currentSlide = totalSlides - 1;
    if (currentSlide < 0) currentSlide = 0;
    
    // Move the track horizontally - calculate slide width dynamically
    const slideWidth = 100 / totalSlides; // Each slide takes equal portion of track
    track.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
    
    // Update dots
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
    
    // Update arrow visibility
    updateArrowVisibility(prevArrow, nextArrow);
}

function goToSlide(slideIndex) {
    const track = document.querySelector('.gallery-track');
    const dots = document.querySelectorAll('.dot');
    const prevArrow = document.querySelector('.carousel-prev');
    const nextArrow = document.querySelector('.carousel-next');
    
    if (!track) return;
    
    currentSlide = slideIndex;
    
    // Move the track horizontally - calculate slide width dynamically
    const slideWidth = 100 / totalSlides; // Each slide takes equal portion of track
    track.style.transform = `translateX(-${currentSlide * slideWidth}%)`;
    
    // Update dots
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
    
    // Update arrow visibility
    updateArrowVisibility(prevArrow, nextArrow);
}

function updateArrowVisibility(prevArrow, nextArrow) {
    if (!prevArrow || !nextArrow) return;
    
    // Show/hide arrows based on current position
    prevArrow.style.display = currentSlide > 0 ? 'flex' : 'none';
    nextArrow.style.display = currentSlide < totalSlides - 1 ? 'flex' : 'none';
}

function updateCarouselDimensions() {
    const track = document.querySelector('.gallery-track');
    if (!track) return;
    
    // Update track width based on number of slides
    track.style.width = `${totalSlides * 100}%`;
    
    // Update slide width
    const slides = document.querySelectorAll('.gallery-slide');
    slides.forEach(slide => {
        slide.style.width = `${100 / totalSlides}%`;
    });
}

async function sendToWebhook(message) {
    if (!hasUserInfo) {
        addBotMessage('Please provide your name and email first.');
        return;
    }
    
    isWaitingForResponse = true;
    
    // Show typing bubble first, then set thinking status (inline appears below)
    showTypingBubble();
    setThinkingStatus();
    
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                userInfo: userInfo,
                sessionId: sessionId,
                timestamp: new Date().toISOString(),
                source: 'chatbot'
            }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Webhook response:', data);

        // Remove typing bubble and inline status
        removeTypingBubble();
        removeInlineStatus();

        // The webhook returns an object, so we access it directly.
        if (data && data.output && data.output.response) {
            const botResponse = data.output.response;
            addBotMessage(botResponse);
        } else {
            addBotMessage('I received an empty response. Please try again.');
        }
        
    } catch (error) {
        console.error('Webhook error:', error);
        // Remove typing bubble and inline status
        removeTypingBubble();
        removeInlineStatus();
        addBotMessage('Sorry, I encountered an error. Please try again later.');
        setOfflineStatus();
    } finally {
        isWaitingForResponse = false;
        setOnlineStatus();
        updateSendButtonState();
    }
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const userInfoModal = document.getElementById('userInfoModal');
    const waitlistModal = document.getElementById('waitlistModal');
    const bookingDisclaimerModal = document.getElementById('bookingDisclaimerModal');
    
    if (event.target === userInfoModal) {
        // Don't close user info modal - it's required
    }
    
    if (event.target === waitlistModal) {
        closeWaitlistModal();
    }
    
    if (event.target === bookingDisclaimerModal) {
        closeBookingDisclaimerModal();
    }
});

// Close virtual tour gallery when clicking outside
document.getElementById('virtualTourGallery').addEventListener('click', function(event) {
    if (event.target === this) {
        closeVirtualTour();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Escape key to close modals
    if (event.key === 'Escape') {
        closeWaitlistModal();
        closeVirtualTour();
        closeBookingDisclaimerModal();
    }
});

// Booking Functions
function handleBookingRequest() {
    // Show typing bubble first, then set thinking status (inline appears below)
    showTypingBubble();
    setThinkingStatus();
    
    setTimeout(() => {
        // Remove waiting indicators and set online status
        const chatMessages = document.getElementById('chatMessages');
        removeInlineStatus();
        removeTypingBubble();
        setOnlineStatus();
        
        if (!hasUserInfo) {
            addBotMessage('I\'d be happy to help you book a storage unit! First, please provide your name and email above, then I can help you with the booking process.');
            return;
        }
        
        // Expire any existing booking form
        expireActiveBookingForm();
        
        if (hasExistingBooking) {
            // Show confirmation for existing booking
            addBotMessage('I see you already have a booking request. Would you like to edit your existing booking or create a new one?');
            addBookingConfirmationButtons();
        } else {
            // Show booking form inline
            addBotMessage('Great! I\'d be happy to help you book a storage unit. Please fill out the form below with your details.');
            setTimeout(() => {
                addBookingForm();
            }, 500);
        }
    }, 1500);
}

function addBookingConfirmationButtons() {
    const chatMessages = document.getElementById('chatMessages');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'message bot-message booking-confirmation';
    buttonDiv.innerHTML = `
        <div class="message-avatar">
            <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
        </div>
        <div class="message-content">
            <div class="booking-confirmation-container">
                <div class="booking-confirmation-buttons">
                    <button class="btn-primary booking-confirm-btn" onclick="editExistingBooking()">
                        <i class="fas fa-edit"></i> Edit Existing Booking
                    </button>
                    <button class="btn-secondary booking-confirm-btn" onclick="createNewBooking()">
                        <i class="fas fa-plus"></i> Book Another Storage
                    </button>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(buttonDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add animation
    setTimeout(() => {
        buttonDiv.style.opacity = '1';
        buttonDiv.style.transform = 'translateY(0)';
    }, 100);
}

function editExistingBooking() {
    // Expire any existing form and create new one with existing data
    expireActiveBookingForm();
    addBotMessage('I\'ll help you edit your existing booking. Please update the details below.');
    setTimeout(() => {
        addBookingForm(currentBookingData);
    }, 500);
}

function createNewBooking() {
    // Expire any existing form and create new one
    expireActiveBookingForm();
    addBotMessage('I\'ll help you create a new booking. Please fill out the details below.');
    setTimeout(() => {
        addBookingForm();
    }, 500);
}

function addBookingForm(existingData = null) {
    const chatMessages = document.getElementById('chatMessages');
    const formDiv = document.createElement('div');
    formDiv.className = 'message bot-message inline-booking';
    formDiv.id = 'activeBookingForm';
    
    // Store reference to active form
    activeBookingForm = formDiv;
    
    formDiv.innerHTML = `
        <div class="message-avatar">
            <img src="StorageAI_Logo.png" alt="StorageAI" class="bot-avatar-img">
        </div>
        <div class="message-content">
            <div class="inline-booking-container">
                <div class="booking-header">
                    <h4>Book Storage Unit</h4>
                    <p>Please fill out the details below to book your storage unit</p>
                </div>
                <form id="inlineBookingForm" onsubmit="handleInlineBookingSubmit(event)">
                    <div class="form-group">
                        <label for="inlineFacility">Facility/Site *</label>
                        <select id="inlineFacility" name="facility" required>
                            <option value="">Select a facility</option>
                            <option value="Deegan Marine" ${existingData && existingData.facility === 'Deegan Marine' ? 'selected' : ''}>Deegan Marine</option>
                            <option value="45 Fieldings Way" ${existingData && existingData.facility === '45 Fieldings Way' ? 'selected' : ''}>45 Fieldings Way</option>
                            <option value="780 South Road" ${existingData && existingData.facility === '780 South Road' ? 'selected' : ''}>780 South Road</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="inlineUnitNumber">Unit Number *</label>
                        <input type="text" id="inlineUnitNumber" name="unitNumber" required placeholder="Enter unit number" value="${existingData ? existingData.unit : ''}">
                    </div>
                    <div class="form-group">
                        <label for="inlineBondAmount">Bond Amount *</label>
                        <input type="number" id="inlineBondAmount" name="bondAmount" required placeholder="Enter bond amount" min="0" step="0.01" value="${existingData ? existingData.bond : ''}">
                    </div>
                    <div class="form-group">
                        <label for="inlineMonthlyAmount">Monthly Amount *</label>
                        <input type="number" id="inlineMonthlyAmount" name="monthlyAmount" required placeholder="Enter monthly amount" min="0" step="0.01" value="${existingData ? existingData.monthly : ''}">
                    </div>
                    <div class="form-group">
                        <label for="inlineLeaseStartDate">Lease Start Date *</label>
                        <input type="date" id="inlineLeaseStartDate" name="leaseStartDate" required value="${existingData ? existingData.leaseStartDate : ''}">
                    </div>
                    <div class="booking-form-actions">
                        <button type="button" class="btn-secondary" onclick="expireActiveBookingForm()">Cancel</button>
                        <button type="submit" class="btn-primary">Submit Booking</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(formDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add animation
    setTimeout(() => {
        formDiv.style.opacity = '1';
        formDiv.style.transform = 'translateY(0)';
    }, 100);
}

function expireActiveBookingForm() {
    if (activeBookingForm) {
        // Change form to expired state
        const formContainer = activeBookingForm.querySelector('.inline-booking-container');
        if (formContainer) {
            formContainer.innerHTML = `
                <div class="booking-expired">
                    <div class="expired-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h4>Form Expired</h4>
                    <p>This form has expired. Kindly click "Book Now" to initiate again.</p>
                </div>
            `;
        }
        activeBookingForm = null;
    }
}

function showBookingDisclaimerModal() {
    document.getElementById('bookingDisclaimerModal').style.display = 'block';
}

function closeBookingDisclaimerModal() {
    document.getElementById('bookingDisclaimerModal').style.display = 'none';
}

function handleInlineBookingSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const bookingData = {
        facility: formData.get('facility'),
        unit: formData.get('unitNumber'),
        bond: formData.get('bondAmount'),
        monthly: formData.get('monthlyAmount'),
        leaseStartDate: formData.get('leaseStartDate')
    };
    
    // Store booking data temporarily
    currentBookingData = bookingData;
    
    // Show disclaimer modal
    showBookingDisclaimerModal();
}

function confirmBooking() {
    // Close disclaimer modal
    closeBookingDisclaimerModal();
    
    // Show submitted state in the form
    showBookingSubmittedState();
    
    // Mark as having existing booking
    hasExistingBooking = true;
    
    // Send booking to webhook (this will handle the response)
    sendBookingToWebhook();
}

function showBookingSubmittedState() {
    if (activeBookingForm) {
        const formContainer = activeBookingForm.querySelector('.inline-booking-container');
        if (formContainer) {
            formContainer.innerHTML = `
                <div class="booking-submitted">
                    <div class="submitted-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h4>Booking Submitted</h4>
                    <p>Your booking request has been submitted successfully!</p>
                    <div class="submitted-details">
                        <p><strong>Facility:</strong> ${currentBookingData.facility}</p>
                        <p><strong>Unit:</strong> ${currentBookingData.unit}</p>
                        <p><strong>Bond:</strong> $${currentBookingData.bond}</p>
                        <p><strong>Monthly:</strong> $${currentBookingData.monthly}</p>
                        <p><strong>Start Date:</strong> ${currentBookingData.leaseStartDate}</p>
                    </div>
                </div>
            `;
        }
        activeBookingForm = null;
    }
}

async function sendBookingToWebhook() {
    if (!hasUserInfo) {
        addBotMessage('Please provide your name and email first before we can continue our conversation.');
        return;
    }
    
    // Show typing bubble and set thinking status
    showTypingBubble();
    setThinkingStatus();
    
    try {
        const payload = {
            message: "I'm going to book",
            userInfo: userInfo,
            booking: currentBookingData || {
                facility: "",
                unit: "",
                bond: "",
                monthly: "",
                leaseStartDate: ""
            },
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            source: 'chatbot'
        };
        
        console.log('Booking webhook request →', WEBHOOK_URL, payload);
        
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let data;
        const text = await response.text();
        try { 
            data = JSON.parse(text); 
        } catch { 
            data = { text }; 
        }
        console.log('Booking webhook response ←', data);
        
        // Remove waiting indicators and set online status
        removeTypingBubble();
        removeInlineStatus();
        setOnlineStatus();
        
        // Process booking webhook response
        if (data && data.output && data.output.response) {
            const botResponse = data.output.response;
            addBotMessage(botResponse);
        } else {
            addBotMessage('I received an empty response for the booking. Please try again.');
        }
        
    } catch (error) {
        console.error('Error sending booking to webhook:', error);
        
        // Remove waiting indicators and set offline status
        removeTypingBubble();
        removeInlineStatus();
        setOfflineStatus();
        
        // Australian-style error messages for booking
        const aussieBookingMessages = [
            "Blimey! I'm having a bit of trouble processing your booking right now. I'm either updating my booking system or improving my responses. Give me a tick and try again, mate!",
            "Crikey! I'm away updating my booking resources at the moment. Try again in a sec and I'll get your booking sorted, yeah?",
            "Fair dinkum! I'm having a moment with the booking system. I'm either refreshing my resources or getting better at processing bookings. Hang tight and give it another go!",
            "Stone the flamin' crows! I'm away improving my booking capabilities. Try again in a moment and I'll get your storage unit sorted!",
            "Oh mate, I'm having a bit of trouble with the booking system right now. I'm either updating my resources or improving to better help you. Give me a sec and try again!"
        ];
        
        const randomMessage = aussieBookingMessages[Math.floor(Math.random() * aussieBookingMessages.length)];
        addBotMessage(randomMessage);
    }
}

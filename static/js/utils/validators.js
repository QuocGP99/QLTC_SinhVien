// validators.js - Form validation utilities

// Email validation
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Password validation (min 8 chars, at least 1 letter and 1 number)
export function isValidPassword(password) {
  if (password.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

// Phone number validation (Vietnamese format)
export function isValidPhone(phone) {
  const re = /^(0|\+84)[0-9]{9}$/;
  return re.test(phone.replace(/\s/g, ''));
}

// Number validation
export function isValidNumber(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

// Positive number validation
export function isPositiveNumber(value) {
  return isValidNumber(value) && parseFloat(value) > 0;
}

// Date validation
export function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Future date validation
export function isFutureDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date > now;
}

// Past date validation
export function isPastDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date < now;
}

// Required field validation
export function isRequired(value) {
  return value !== null && value !== undefined && value.toString().trim() !== '';
}

// Min length validation
export function minLength(value, min) {
  return value && value.length >= min;
}

// Max length validation
export function maxLength(value, max) {
  return value && value.length <= max;
}

// Range validation
export function inRange(value, min, max) {
  const num = parseFloat(value);
  return num >= min && num <= max;
}

// URL validation
export function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Form validation helper
export function validateForm(formElement, rules) {
  const errors = {};
  
  Object.entries(rules).forEach(([fieldName, fieldRules]) => {
    const field = formElement.elements[fieldName];
    if (!field) return;
    
    const value = field.value;
    
    fieldRules.forEach(rule => {
      if (rule.type === 'required' && !isRequired(value)) {
        errors[fieldName] = rule.message || 'Trường này là bắt buộc';
      }
      if (rule.type === 'email' && value && !isValidEmail(value)) {
        errors[fieldName] = rule.message || 'Email không hợp lệ';
      }
      if (rule.type === 'password' && value && !isValidPassword(value)) {
        errors[fieldName] = rule.message || 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ và số';
      }
      if (rule.type === 'minLength' && value && !minLength(value, rule.value)) {
        errors[fieldName] = rule.message || `Tối thiểu ${rule.value} ký tự`;
      }
      if (rule.type === 'maxLength' && value && !maxLength(value, rule.value)) {
        errors[fieldName] = rule.message || `Tối đa ${rule.value} ký tự`;
      }
      if (rule.type === 'positive' && value && !isPositiveNumber(value)) {
        errors[fieldName] = rule.message || 'Giá trị phải lớn hơn 0';
      }
    });
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Display validation errors
export function displayErrors(formElement, errors) {
  // Clear previous errors
  formElement.querySelectorAll('.is-invalid').forEach(el => {
    el.classList.remove('is-invalid');
  });
  formElement.querySelectorAll('.invalid-feedback').forEach(el => {
    el.remove();
  });
  
  // Display new errors
  Object.entries(errors).forEach(([fieldName, message]) => {
    const field = formElement.elements[fieldName];
    if (field) {
      field.classList.add('is-invalid');
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      feedback.textContent = message;
      field.parentNode.appendChild(feedback);
    }
  });
}

// Small reusable validators keep form validation logic declarative in the pages.
// Checks that a string contains non-whitespace content.
export const required = value => value.trim() !== '';

// Builds a validator that enforces optional min and max string lengths.
export const length = config => value => {
  let isValid = true;
  if (config.min) {
    isValid = isValid && value.trim().length >= config.min;
  }
  if (config.max) {
    isValid = isValid && value.trim().length <= config.max;
  }
  return isValid;
};

// Checks that a string matches the app's email format requirements.
export const email = value =>
  /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(
    value
  );

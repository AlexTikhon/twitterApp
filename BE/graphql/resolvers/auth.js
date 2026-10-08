const { spendAuthBudget } = require('../auth-budget');

module.exports = {
  RootMutation: {
    createUser: async (_parent, { userInput }, context) => {
      spendAuthBudget(context);
      return context.services.auth.signup(userInput);
    },
    login: async (_parent, { email, password }, context) => {
      spendAuthBudget(context);
      return context.services.auth.login(email, password);
    }
  }
};

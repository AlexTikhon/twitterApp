module.exports = {
  RootMutation: {
    createUser: (_parent, { userInput }, { services }) => services.auth.signup(userInput),
    login: (_parent, { email, password }, { services }) => services.auth.login(email, password)
  }
};

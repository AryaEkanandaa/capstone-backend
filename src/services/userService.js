
const users = [];

exports.findUserByEmail = (email) => {
    return users.find(user => user.email === email);
};

exports.createUser = (user) => {
    const newUser = { id: Date.now().toString(), ...user };
    users.push(newUser);
    return newUser;
};

exports.getMockUsers = () => users;
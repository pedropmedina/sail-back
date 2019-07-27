module.exports = (friends1, friends2, userId1, userId2) => {
  return (
    friends1.some(f => f.toString() === userId1.toString()) &&
    friends2.some(f => f.toString() === userId2.toString())
  );
};

const createTransactionRunner = (connection) => async (work) => {
  const session = await connection.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = { createTransactionRunner };

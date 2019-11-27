const prodOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: true,
  sameSite: 'None'
};

const devOptions = { ...prodOptions, secure: false, sameSite: false };

const defaultOptions =
  process.env.NODE_ENV === 'production' ? prodOptions : devOptions;

module.exports = (res, name, token, options = defaultOptions) => {
  res.cookie(name, token, options);
};

// Body-validation middleware factory. Parses req.body against a zod schema; on failure
// responds 400 with the field errors, on success replaces req.body with the parsed data.

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };

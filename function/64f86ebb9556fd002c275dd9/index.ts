import * as Identity from "@spica-devkit/identity";

const CLIENT_API_KEY = process.env.CLIENT_API_KEY;
const SECRET_API_KEY = process.env.SECRET_API_KEY;

export async function login(req, res) {
    Identity.initialize({ apikey: CLIENT_API_KEY });

    const { email, password } = req.body;

    let jwt;
    try {
        jwt = await Identity.login(email, password)
    } catch (err) {
        res.status(400).send(err)
    }

    return res.status(200).send({
        token: jwt
    })
}

export async function registration(req, res) {
  Identity.initialize({ apikey: SECRET_API_KEY });

  const { email, password } = req.body;

  let newIdentity = {
    identifier: email,
    password: password,
    policies: ["6518101382063a002c6f6866"],
  };

  try {
    await Identity.insert(newIdentity);
  } catch (err) {
    return res.status(400).send(err)
  }

  let jwt;
  try {
    jwt = await Identity.login(email, password)
  } catch (err) {
    return res.status(400).send(err)
  }

  return res.status(200).send({
    token: jwt
  })
}
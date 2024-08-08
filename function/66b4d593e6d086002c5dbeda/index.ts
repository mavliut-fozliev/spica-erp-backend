import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export async function getAvailableProjects(req, res) {
	const jwt = req.headers.get('authorization');
	Bucket.initialize({ identity: jwt })

	return res.status(201).send([]);
}
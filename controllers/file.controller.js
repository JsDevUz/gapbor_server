var path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const { get } = require("lodash");
async function getFile(req, res) {
  const { imgId } = req.params;
  res.sendFile(path.resolve(`./uploads/${imgId}`));
}
async function getFileTemp(req, res) {
  const { imgId } = req.params;
  res.sendFile(path.resolve(`./uploads/temp/${imgId}`));
}

async function uploadImg(req, res) {
  try {
    if (!get(req, "files")) return res.status(400).send("Fayl yuklanmagan");
    const fileOldName = get(req, "files.file.name");
    let re = /(\.jpg|\.jpeg|\.gif|\.png)$/i;

    if (!re.exec(fileOldName))
      return res.status(400).send("Fayl turi mos kelmadi");

    const file = get(req, "files.file");
    const fileName = uuidv4();
    const fileType = get(file, "mimetype").split("/")[1];
    const path = "./uploads/temp/" + fileName + "." + fileType;
    file.mv(path, (err) => {
      if (err) return res.status(400).send({ message: err });

      return res.send({
        status: "success",
        path: `temp/${fileName}.${fileType}`,
      });
    });
  } catch (e) {
    throw e;
  }
}
module.exports = { getFile, getFileTemp, uploadImg };

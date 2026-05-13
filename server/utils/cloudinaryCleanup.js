const { cloudinary, hasCloudinaryConfig } = require("../config/cloudinary");

const extractCloudinaryPublicId = (value) => {
  if (!hasCloudinaryConfig || !value || typeof value !== "string") return null;
  if (!value.includes("res.cloudinary.com")) return null;

  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname || "");
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    let publicId = pathname.slice(uploadIndex + "/upload/".length);
    publicId = publicId.replace(/^v\d+\//, "");
    publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, "");
    return publicId || null;
  } catch {
    return null;
  }
};

const deleteCloudinaryAsset = async (value) => {
  const publicId = extractCloudinaryPublicId(value);
  if (!publicId) return false;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return true;
  } catch (error) {
    console.error("Cloudinary delete failed:", error.message);
    return false;
  }
};

const deleteCloudinaryAssetsFromRecord = async (record, fields = []) => {
  if (!record) return;
  await Promise.all(
    fields
      .map((field) => [field, record[field]])
      .filter(([, value]) => Boolean(value))
      .map(([field, value]) => {
        if (field.toLowerCase().endsWith("publicid")) {
          return cloudinary.uploader.destroy(String(value), {
            resource_type: "image",
          });
        }

        return deleteCloudinaryAsset(value);
      }),
  );
};

module.exports = {
  extractCloudinaryPublicId,
  deleteCloudinaryAsset,
  deleteCloudinaryAssetsFromRecord,
};

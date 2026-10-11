import uuid

import boto3
from botocore.client import Config as BotoConfig

from app.core.config import settings


class S3Service:
    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=BotoConfig(signature_version="s3v4"),
        )
        self._bucket = settings.s3_bucket

    def ensure_bucket(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except Exception:
            self._client.create_bucket(Bucket=self._bucket)

    def upload_image(self, content: bytes, content_type: str, ext: str = "jpg") -> str:
        key = f"menu/{uuid.uuid4().hex}.{ext}"
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            ACL="public-read",
        )
        return key

    def presigned_url(self, key: str, expires: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires,
        )

    def public_url(self, key: str) -> str:
        return f"{settings.s3_endpoint.rstrip('/')}/{self._bucket}/{key}"


_singleton: S3Service | None = None


def get_s3() -> S3Service:
    global _singleton
    if _singleton is None:
        _singleton = S3Service()
    return _singleton
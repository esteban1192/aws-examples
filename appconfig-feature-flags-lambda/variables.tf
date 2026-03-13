variable "aws_region" {
  default = "us-east-1"
}

variable "project_name" {
  default = "appconfig-feature-flags"
}

# https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions-versions.html
variable "appconfig_extension_version" {
  description = "Version number for the AWS AppConfig Lambda extension layer"
  default     = 128
}

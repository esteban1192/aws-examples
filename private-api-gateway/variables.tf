variable "aws_region" {
  default = "us-east-1"
}

variable "provider_vpc_cidr" {
  default = "10.0.0.0/16"
}

variable "consumer_vpc_cidr" {
  default = "10.1.0.0/16"
}

variable "project_name" {
  default = "private-apigw-demo"
}

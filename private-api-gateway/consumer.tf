# =============================================================================
# Consumer VPC
# =============================================================================

resource "aws_vpc" "consumer" {
  cidr_block           = var.consumer_vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-consumer-vpc" }
}

resource "aws_subnet" "consumer_private" {
  count             = 2
  vpc_id            = aws_vpc.consumer.id
  cidr_block        = cidrsubnet(var.consumer_vpc_cidr, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.project_name}-consumer-private-${count.index + 1}" }
}

# =============================================================================
# VPC Endpoint for execute-api (allows reaching the Private API Gateway)
# =============================================================================

resource "aws_security_group" "vpce" {
  name_prefix = "${var.project_name}-vpce-"
  description = "Allow HTTPS from consumer VPC"
  vpc_id      = aws_vpc.consumer.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.consumer_vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-vpce-sg" }
}

resource "aws_vpc_endpoint" "execute_api" {
  vpc_id              = aws_vpc.consumer.id
  service_name        = "com.amazonaws.${var.aws_region}.execute-api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.consumer_private[*].id
  security_group_ids  = [aws_security_group.vpce.id]

  tags = { Name = "${var.project_name}-execute-api-vpce" }
}

# =============================================================================
# Consumer Lambda
# =============================================================================

data "archive_file" "consumer_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/consumer"
  output_path = "${path.module}/lambda/consumer.zip"
}

resource "aws_iam_role" "consumer_lambda" {
  name = "${var.project_name}-consumer-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "consumer_lambda_basic" {
  role       = aws_iam_role.consumer_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "consumer_lambda_vpc" {
  role       = aws_iam_role.consumer_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_security_group" "consumer_lambda" {
  name_prefix = "${var.project_name}-consumer-lambda-"
  description = "Consumer Lambda outbound HTTPS and DNS"
  vpc_id      = aws_vpc.consumer.id

  egress {
    description = "HTTPS to VPC (for VPC endpoint)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.consumer_vpc_cidr]
  }

  egress {
    description = "DNS (UDP)"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.consumer_vpc_cidr]
  }

  egress {
    description = "DNS (TCP)"
    from_port   = 53
    to_port     = 53
    protocol    = "tcp"
    cidr_blocks = [var.consumer_vpc_cidr]
  }

  tags = { Name = "${var.project_name}-consumer-lambda-sg" }
}

resource "aws_lambda_function" "consumer" {
  function_name    = "${var.project_name}-consumer"
  role             = aws_iam_role.consumer_lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.consumer_lambda.output_path
  source_code_hash = data.archive_file.consumer_lambda.output_base64sha256
  timeout          = 15

  vpc_config {
    subnet_ids         = aws_subnet.consumer_private[*].id
    security_group_ids = [aws_security_group.consumer_lambda.id]
  }

  environment {
    variables = {
      API_URL = "${aws_api_gateway_stage.dev.invoke_url}/hello"
    }
  }
}

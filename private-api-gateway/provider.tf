# =============================================================================
# Provider VPC
# =============================================================================

resource "aws_vpc" "provider" {
  cidr_block           = var.provider_vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project_name}-provider-vpc" }
}

resource "aws_subnet" "provider_private" {
  count             = 2
  vpc_id            = aws_vpc.provider.id
  cidr_block        = cidrsubnet(var.provider_vpc_cidr, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.project_name}-provider-private-${count.index + 1}" }
}

# =============================================================================
# Provider Lambda (API backend)
# =============================================================================

data "archive_file" "provider_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/provider"
  output_path = "${path.module}/lambda/provider.zip"
}

resource "aws_iam_role" "provider_lambda" {
  name = "${var.project_name}-provider-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "provider_lambda_basic" {
  role       = aws_iam_role.provider_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "provider_lambda_vpc" {
  role       = aws_iam_role.provider_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_security_group" "provider_lambda" {
  name_prefix = "${var.project_name}-provider-lambda-"
  description = "Provider Lambda security group"
  vpc_id      = aws_vpc.provider.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-provider-lambda-sg" }
}

resource "aws_lambda_function" "provider" {
  function_name    = "${var.project_name}-provider"
  role             = aws_iam_role.provider_lambda.arn
  handler          = "index.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.provider_lambda.output_path
  source_code_hash = data.archive_file.provider_lambda.output_base64sha256
  timeout          = 10

  vpc_config {
    subnet_ids         = aws_subnet.provider_private[*].id
    security_group_ids = [aws_security_group.provider_lambda.id]
  }
}

# =============================================================================
# Private API Gateway
# =============================================================================

resource "aws_api_gateway_rest_api" "private" {
  name = "${var.project_name}-private-api"

  endpoint_configuration {
    types = ["PRIVATE"]
  }

  # Only allow access from the consumer's VPC Endpoint
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = "*"
        Action    = "execute-api:Invoke"
        Resource  = "execute-api:/*"
        Condition = {
          StringEquals = {
            "aws:sourceVpce" = aws_vpc_endpoint.execute_api.id
          }
        }
      }
    ]
  })
}

# GET /hello
resource "aws_api_gateway_resource" "hello" {
  rest_api_id = aws_api_gateway_rest_api.private.id
  parent_id   = aws_api_gateway_rest_api.private.root_resource_id
  path_part   = "hello"
}

resource "aws_api_gateway_method" "hello_get" {
  rest_api_id   = aws_api_gateway_rest_api.private.id
  resource_id   = aws_api_gateway_resource.hello.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "hello_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.private.id
  resource_id             = aws_api_gateway_resource.hello.id
  http_method             = aws_api_gateway_method.hello_get.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.provider.invoke_arn
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.provider.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.private.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "private" {
  rest_api_id = aws_api_gateway_rest_api.private.id

  depends_on = [aws_api_gateway_integration.hello_lambda]

  # Redeploy when API definition changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.hello.id,
      aws_api_gateway_method.hello_get.id,
      aws_api_gateway_integration.hello_lambda.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "dev" {
  deployment_id = aws_api_gateway_deployment.private.id
  rest_api_id   = aws_api_gateway_rest_api.private.id
  stage_name    = "dev"
}

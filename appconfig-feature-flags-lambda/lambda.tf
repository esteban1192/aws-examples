# =============================================================================
# Lambda function
# =============================================================================

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "appconfig_access" {
  name = "appconfig-access"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "appconfig:StartConfigurationSession",
        "appconfig:GetLatestConfiguration"
      ]
      Resource = "*"
    }]
  })
}

# https://docs.aws.amazon.com/appconfig/latest/userguide/appconfig-integration-lambda-extensions-versions.html
locals {
  appconfig_extension_arn = "arn:aws:lambda:us-east-1:027255383542:layer:AWS-AppConfig-Extension:${var.appconfig_extension_version}"
}

resource "aws_lambda_function" "this" {
  function_name    = "${var.project_name}-handler"
  role             = aws_iam_role.lambda.arn
  handler          = "app.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 10

  layers = [local.appconfig_extension_arn]

  environment {
    variables = {
      APPCONFIG_APPLICATION   = aws_appconfig_application.this.id
      APPCONFIG_ENVIRONMENT   = aws_appconfig_environment.dev.environment_id
      APPCONFIG_CONFIGURATION = aws_appconfig_configuration_profile.feature_flags.configuration_profile_id
    }
  }
}

# =============================================================================
# API Gateway (HTTP API)
# =============================================================================

resource "aws_apigatewayv2_api" "this" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_product" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "GET /product/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

# =============================================================================
# Test the deployed API
# =============================================================================

data "http" "api_test" {
  url = "${aws_apigatewayv2_api.this.api_endpoint}/product/1"

  depends_on = [
    aws_apigatewayv2_stage.default,
    aws_apigatewayv2_route.get_product,
    aws_lambda_permission.apigw,
    aws_appconfig_deployment.feature_flags,
  ]
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.this.api_endpoint}/product/{id}"
}

output "lambda_function_name" {
  value = aws_lambda_function.this.function_name
}

output "appconfig_application_id" {
  value = aws_appconfig_application.this.id
}

output "api_response" {
  description = "Response from the API for product 1"
  value       = data.http.api_test.response_body
}

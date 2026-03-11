output "api_gateway_url" {
  description = "Private API Gateway invoke URL"
  value       = "${aws_api_gateway_stage.dev.invoke_url}/hello"
}

output "provider_lambda_name" {
  value = aws_lambda_function.provider.function_name
}

output "consumer_lambda_name" {
  value = aws_lambda_function.consumer.function_name
}

output "vpc_endpoint_id" {
  value = aws_vpc_endpoint.execute_api.id
}

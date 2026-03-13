resource "aws_appconfig_application" "this" {
  name        = var.project_name
  description = "Feature flags demo application"
}

resource "aws_appconfig_environment" "dev" {
  name           = "dev"
  application_id = aws_appconfig_application.this.id
  description    = "Development environment"
}

resource "aws_appconfig_configuration_profile" "feature_flags" {
  application_id = aws_appconfig_application.this.id
  name           = "feature-flags"
  location_uri   = "hosted"
  type           = "AWS.AppConfig.FeatureFlags"
}

resource "aws_appconfig_deployment_strategy" "linear" {
  name                           = "${var.project_name}-linear"
  deployment_duration_in_minutes = 1
  growth_factor                  = 50
  growth_type                    = "LINEAR"
  final_bake_time_in_minutes     = 0
  replicate_to                   = "NONE"
}

resource "aws_appconfig_hosted_configuration_version" "feature_flags" {
  application_id           = aws_appconfig_application.this.id
  configuration_profile_id = aws_appconfig_configuration_profile.feature_flags.configuration_profile_id
  content_type             = "application/json"

  content = jsonencode({
    version = "1"
    flags = {
      detailed_response = {
        name        = "Detailed Response"
        description = "Include additional product details in the API response"
      }
      discount_banner = {
        name        = "Discount Banner"
        description = "Show a promotional discount banner"
        attributes = {
          message          = { constraints = { type = "string" } }
          discount_percent = { constraints = { type = "number" } }
        }
      }
    }
    values = {
      detailed_response = {
        enabled = false
      }
      discount_banner = {
        enabled          = false
        message          = "Summer Sale!"
        discount_percent = 15
      }
    }
  })
}

resource "aws_appconfig_deployment" "feature_flags" {
  application_id           = aws_appconfig_application.this.id
  environment_id           = aws_appconfig_environment.dev.environment_id
  configuration_profile_id = aws_appconfig_configuration_profile.feature_flags.configuration_profile_id
  configuration_version    = aws_appconfig_hosted_configuration_version.feature_flags.version_number
  deployment_strategy_id   = aws_appconfig_deployment_strategy.linear.id
}

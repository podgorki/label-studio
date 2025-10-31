# To deploy, run:
#   $ terraform init
#   $ terraform apply
#
# Make sure you have the right AWS credentials configured in your environment, for example:
#   $ export AWS_PROFILE=...
#   $ aws sso login

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 6.18.0" }
  }

  backend "s3" {
    bucket       = "terraform-state.supersensory.com.au"
    key          = "apps/label-studio.tfstate"
    region       = "ap-southeast-2"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = "ap-southeast-2"
}

resource "aws_security_group" "ssh" {
  name = "label-studio-ssh"
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "http" {
  name = "label-studio-http"
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# IAM role for EC2 to SSM
resource "aws_iam_role" "ssm" {
  name = "label-studio-ssm-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  role = aws_iam_role.ssm.name
}

resource "aws_instance" "ec2_instance" {
  ami           = "ami-0279a86684f669718" # Ubuntu
  instance_type = "t3.large"
  tags = {
    Name = "label-studio"
  }
  security_groups      = [aws_security_group.ssh.name, aws_security_group.http.name]
  iam_instance_profile = aws_iam_instance_profile.ssm.name
  user_data            = <<-EOF
              #!/bin/bash
              sudo apt update
              sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
              sudo systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
              sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service
              EOF

  root_block_device {
    volume_size = 40 # 40GB root disk
    volume_type = "gp3"
  }
}

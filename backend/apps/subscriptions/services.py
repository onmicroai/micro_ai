import logging
from django.db import transaction
from apps.subscriptions.models import Coupon, CouponUsage, SubscriptionConfiguration, Subscription, TopUpToSubscription
from apps.utils.usage_helper import subscription_details

logger = logging.getLogger(__name__)

class CouponActionService:
    """Service class to handle coupon action execution"""
    
    @staticmethod
    def execute_action(coupon, user):
        """
        Execute the action specified by the coupon for the given user
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and message
        """
        try:
            if coupon.action == 'increase_max_apps':
                return CouponActionService._execute_increase_max_apps(coupon, user)
            elif coupon.action == 'increase_max_apps_and_credits':
                return CouponActionService._execute_increase_max_apps_and_credits(coupon, user)
            else:
                return {
                    'success': False,
                    'message': f'Unknown action: {coupon.action}'
                }
        except Exception as e:
            logger.error(f"Error executing coupon action {coupon.action}: {str(e)}")
            return {
                'success': False,
                'message': f'Error executing action: {str(e)}'
            }
    
    @staticmethod
    def _execute_increase_max_apps(coupon, user):
        """
        Execute the increase_max_apps action
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and max_apps value
        """
        try:
            # Get the max_apps value from additional_data
            max_apps = coupon.get_action_value('max_apps')
            if not max_apps:
                return {
                    'success': False,
                    'message': 'max_apps value not found in coupon data'
                }
            
            # Get user's subscription
            subscription_data = subscription_details(user.id)
            if not subscription_data:
                return {
                    'success': False,
                    'message': 'User has no active subscription'
                }
            
            # Get or create SubscriptionConfiguration
            subscription_instance = Subscription.objects.get(id=subscription_data["id"])
            config, created = SubscriptionConfiguration.objects.get_or_create(
                subscription=subscription_instance,
                defaults={'max_apps': max_apps}
            )
            
            if not created:
                # Update existing configuration
                config.max_apps = max_apps
                config.save()
            
            return {
                'success': True,
                'message': f'Successfully set max_apps to {max_apps}',
                'max_apps': max_apps
            }
            
        except Subscription.DoesNotExist:
            return {
                'success': False,
                'message': 'User subscription not found'
            }
        except Exception as e:
            logger.error(f"Error in increase_max_apps action: {str(e)}")
            return {
                'success': False,
                'message': f'Error updating max_apps: {str(e)}'
            } 

    @staticmethod
    def _execute_increase_max_apps_and_credits(coupon, user):
        """
        Execute the increase_max_apps_and_credits action
        
        Args:
            coupon: Coupon instance
            user: User instance
            
        Returns:
            dict: Result with success status and values
        """
        try:
            # Get the values from additional_data
            max_apps = coupon.get_action_value('max_apps')
            credits = coupon.get_action_value('credits')
            
            if not max_apps:
                return {
                    'success': False,
                    'message': 'max_apps value not found in coupon data'
                }
            
            if not credits:
                return {
                    'success': False,
                    'message': 'credits value not found in coupon data'
                }
            
            # Get user's subscription
            subscription_data = subscription_details(user.id)
            if not subscription_data:
                return {
                    'success': False,
                    'message': 'User has no active subscription'
                }
            
            # Use transaction to ensure both operations succeed or fail together
            with transaction.atomic():
                # 1. Update max_apps
                subscription_instance = Subscription.objects.get(id=subscription_data["id"])
                config, created = SubscriptionConfiguration.objects.get_or_create(
                    subscription=subscription_instance,
                    defaults={'max_apps': max_apps}
                )
                
                if not created:
                    config.max_apps = max_apps
                    config.save()
                
                # 2. Create TopUpToSubscription
                top_up = TopUpToSubscription.objects.create(
                    user=user,
                    allocated_credits=credits,
                    used_credits=0,
                )
            
            return {
                'success': True,
                'message': f'Successfully set max_apps to {max_apps} and added {credits:,} credits',
                'max_apps': max_apps,
                'credits': credits
            }
            
        except Subscription.DoesNotExist:
            return {
                'success': False,
                'message': 'User subscription not found'
            }
        except Exception as e:
            logger.error(f"Error in increase_max_apps_and_credits action: {str(e)}")
            return {
                'success': False,
                'message': f'Error updating max_apps and credits: {str(e)}'
            } 
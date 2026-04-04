"""
Sieve of Eratosthenes implementation to find all prime numbers up to n.

The Sieve of Eratosthenes is an ancient algorithm for finding all prime numbers
up to a specified integer n. It works by iteratively marking the multiples of
each prime number starting from 2.

Example:
    >>> sieve_of_eratosthenes(30)
    [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
"""

from typing import List


def sieve_of_eratosthenes(n: int) -> List[int]:
    """
    Find all prime numbers up to n using the Sieve of Eratosthenes algorithm.

    Args:
        n: The upper limit (inclusive) for finding prime numbers.
            Must be a positive integer greater than or equal to 2.

    Returns:
        A list of prime numbers up to n, in ascending order.

    Raises:
        ValueError: If n is less than 2.

    Examples:
        >>> sieve_of_eratosthenes(10)
        [2, 3, 5, 7]
        >>> sieve_of_eratosthenes(20)
        [2, 3, 5, 7, 11, 13, 17, 19]
    """
    if n < 2:
        raise ValueError("n must be a positive integer greater than or equal to 2")

    # Initialize a boolean array "is_prime[0..n]" and set all entries to True.
    # A value in is_prime[i] will be False if i is not a prime, True otherwise.
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False  # 0 and 1 are not prime numbers

    # Start with the first prime number, 2.
    for current in range(2, int(n ** 0.5) + 1):
        if is_prime[current]:
            # Mark all multiples of current as not prime.
            # Start from current^2 because smaller multiples would have
            # already been marked by smaller primes.
            for multiple in range(current * current, n + 1, current):
                is_prime[multiple] = False

    # Collect all prime numbers.
    primes = [i for i, prime in enumerate(is_prime) if prime]
    return primes


if __name__ == "__main__":
    # Example usage
    print(sieve_of_eratosthenes(100))
